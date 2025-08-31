import React from 'react'

export default function ChatView({ isHidden }: { isHidden: boolean }) {
  if (isHidden) return null
  return <div data-testid="chat-view-stub">ChatView (stub)</div>
}

