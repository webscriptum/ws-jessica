import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props): JSX.Element {
  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="bubble-label">
        {message.role === 'user' ? 'Tu' : 'Harmonic Noodle'}
      </div>
      <div className="bubble-content">
        {message.role === 'assistant' ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        ) : (
          <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
        )}
        {message.isStreaming && <span className="cursor-blink">▊</span>}
      </div>
    </div>
  )
}
