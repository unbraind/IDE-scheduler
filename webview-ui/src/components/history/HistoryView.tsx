import React from 'react'

export default function HistoryView({ onDone }: { onDone: () => void }) {
  return (
    <div data-testid="history-view-stub">
      <button onClick={onDone}>Done</button>
    </div>
  )
}

