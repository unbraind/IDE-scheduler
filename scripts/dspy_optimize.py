#!/usr/bin/env python3
"""
Tiny DSPy optimizer bridge for Agent Scheduler.

Usage:
  python scripts/dspy_optimize.py --optimizer mipro|gepa --model <MODEL> --dataset <path.jsonl> --out <prompt.txt>

Notes:
  - Requires `dspy` installed. For GEPA, DSPy must include GEPA support (or `gepa` package if separate).
  - Dataset format: JSONL with objects having fields { "input": str, "output": str }.
  - Writes a plain optimized instruction/prompt to --out and prints the path.
"""
import argparse, json, os, sys

def load_jsonl(path):
    data=[]
    if path and os.path.exists(path):
        with open(path,'r',encoding='utf-8') as f:
            for line in f:
                line=line.strip()
                if not line: continue
                try: data.append(json.loads(line))
                except: pass
    if not data:
        # fallback tiny seed
        data=[{"input":"Write a function add(a,b) in TypeScript","output":"function add(a:number,b:number){return a+b}"},
              {"input":"Refactor variable x to be const","output":"Use const for x where reassignment is not needed."}]
    return data

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--optimizer', choices=['mipro','gepa'], default='mipro')
    p.add_argument('--model', default=os.getenv('DSPY_MODEL','gpt-4o-mini'))
    p.add_argument('--dataset', default='')
    p.add_argument('--out', default='dspy_optimized_prompt.txt')
    args=p.parse_args()

    try:
        import dspy
    except Exception as e:
        print('ERROR: dspy not installed:', e, file=sys.stderr)
        return 1

    # Configure model
    try:
        dspy.settings.configure(lm=dspy.OpenAI(model=args.model))
    except Exception:
        # Fall back to default settings; users can override via environment
        pass

    # Simple signature: map input->output
    class CodeSignature(dspy.Signature):
        """Given a coding instruction, produce a high-quality answer."""
        instruction = dspy.InputField()
        answer = dspy.OutputField()

    # Program that converts instruction to answer via a single call.
    class CodeProgram(dspy.Module):
        def __init__(self):
            super().__init__()
            self.gen = dspy.ChainOfThought(CodeSignature)
        def forward(self, instruction):
            return self.gen(instruction=instruction)

    # Build train/val
    data = load_jsonl(args.dataset)
    train = [dspy.Example(instruction=ex.get('input',''), answer=ex.get('output','')).with_inputs('instruction') for ex in data[: max(1,len(data)//2)]]
    val   = [dspy.Example(instruction=ex.get('input',''), answer=ex.get('output','')).with_inputs('instruction') for ex in data[max(1,len(data)//2):]]

    metric = dspy.evaluate.answer_exact_match

    if args.optimizer == 'gepa':
        # GEPA: reflective prompt evolution, if available in dspy
        try:
            Optim = getattr(dspy, 'GEPA')
        except AttributeError:
            print('WARNING: GEPA not found in dspy; falling back to MIPROv2', file=sys.stderr)
            Optim = dspy.MIPROv2
    else:
        Optim = dspy.MIPROv2

    opt = Optim(metric=metric, max_bootstrapped_demos=4, max_labeled_demos=4)
    optimized = opt.compile(CodeProgram(), trainset=train, valset=val)

    # Extract a concise instruction prompt (heuristic)
    prompt = getattr(optimized, 'instructions', None) or 'Please follow best practices for clean, typed TypeScript code.'
    with open(args.out,'w',encoding='utf-8') as f:
        f.write(str(prompt).strip()+"\n")
    print(args.out)
    return 0

if __name__=='__main__':
    raise SystemExit(main())

