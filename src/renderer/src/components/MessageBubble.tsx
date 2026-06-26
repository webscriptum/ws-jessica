import ReactMarkdown from 'react-markdown'
import JessicaAvatar from './JessicaAvatar'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  imageBase64?: string
  imageName?: string
}

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props): JSX.Element {
  return (
    <div className={`message-bubble ${message.role}`}>
      {message.role === 'assistant' && <JessicaAvatar size={28} />}
      <div className={message.role === 'assistant' ? 'bubble-assistant-body' : undefined}>
        <div className="bubble-label">
          {message.role === 'user' ? 'Tu' : 'Jessica'}
        </div>
        <div className="bubble-content">
          {message.imageBase64 ? (
            <div className="bubble-image-wrapper">
              <img
                src={`data:image/png;base64,${message.imageBase64}`}
                alt={message.imageName ?? 'Immagine generata'}
                className="bubble-image"
              />
              {message.imageName && (
                <p className="bubble-image-caption">{message.imageName}</p>
              )}
            </div>
          ) : message.role === 'assistant' ? (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          ) : (
            <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
          )}
          {message.isStreaming && !message.imageBase64 && (
            <span className="cursor-blink">▊</span>
          )}
        </div>
      </div>
    </div>
  )
}
