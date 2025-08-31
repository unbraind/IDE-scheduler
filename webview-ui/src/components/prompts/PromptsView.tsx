import React from 'react'

export default function PromptsView({ onDone }: { onDone: () => void }) {
  return (
    <div data-testid="prompts-view-stub">
      <button onClick={onDone}>Done</button>
    </div>
  )
}

