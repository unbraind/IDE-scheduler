import React from 'react'

export default function McpView({ onDone }: { onDone: () => void }) {
  return (
    <div data-testid="mcp-view-stub">
      <button onClick={onDone}>Done</button>
    </div>
  )
}

