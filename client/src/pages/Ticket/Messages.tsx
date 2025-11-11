import Message from "./Message"
import MessageInput from "./MessageInput"
import NoMessages from "./NoMessages"

type Props = {
  messages: {
    message: string
    date: string
    user: {
        _id: string
        name: string
        avatar?: string
    }
  }[]
  refresh: () => Promise<void>
}

const Messages = ({ messages, refresh }: Props) => {

  return (
    <section className="messages container">
      <h2>{"Messages"} { !!messages.length && <span>({ messages.length })</span> }</h2>
      { messages.length > 0
        ? <>{ messages.map((message, index) => <Message key={index} message={message} /> )}</>
        : <NoMessages />
      }
      <MessageInput refresh={refresh} />
    </section>
  )
}

export default Messages