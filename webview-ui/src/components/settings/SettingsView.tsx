import React from 'react'

export default function SettingsView({ onDone }: { onDone: () => void }) {
  return (
    <div data-testid="settings-view-stub">
      <button onClick={onDone}>Done</button>
    </div>
  )
}

