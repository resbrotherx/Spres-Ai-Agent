const React = require('react');
const {
  useCallback,
  useMemo,
  useRef,
  useState
} = require('react');
const {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} = require('react-native');

function createMessage(role, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text
  };
}

function ChatScreen(props) {
  const {
    sdk,
    title = 'Brainbox Chat',
    placeholder = 'Ask a question...',
    primaryColor = '#2563EB',
    accentColor = '#111827',
    style,
    headerStyle,
    inputStyle,
    buttonText = 'Send'
  } = props;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !sdk) return;

    const userMessage = createMessage('user', trimmed);
    const assistantMessage = createMessage('assistant', 'Typing...');
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setText('');
    setSending(true);

    const assistantId = assistantMessage.id;

    await sdk.streamChat(
      trimmed,
      undefined,
      chunk => {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id !== assistantId) return msg;
            return {
              ...msg,
              text: msg.text === 'Typing...' ? chunk : msg.text + chunk
            };
          })
        );
      },
      () => {
        setSending(false);
      },
      error => {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id !== assistantId) return msg;
            return {
              ...msg,
              text: `Error: ${error.message}`
            };
          })
        );
        setSending(false);
      }
    );
  }, [sdk, text]);

  const renderedMessages = useMemo(
    () =>
      messages.map(message =>
        React.createElement(
          View,
          {
            key: message.id,
            style:
              message.role === 'user'
                ? styles.userMessageRow
                : styles.assistantMessageRow
          },
          React.createElement(
            View,
            {
              style:
                message.role === 'user'
                  ? [styles.userMessageBubble, { backgroundColor: primaryColor }]
                  : [styles.assistantMessageBubble, { backgroundColor: accentColor }]
            },
            React.createElement(Text, { style: styles.messageText }, message.text)
          )
        )
      ),
    [messages, accentColor, primaryColor]
  );

  return React.createElement(
    View,
    { style: [styles.container, style] },
    React.createElement(
      View,
      { style: [styles.header, headerStyle, { backgroundColor: primaryColor }] },
      React.createElement(Text, { style: styles.title }, title)
    ),
    React.createElement(
      ScrollView,
      {
        ref: scrollRef,
        style: styles.messages,
        contentContainerStyle: styles.messagesContent
      },
      renderedMessages,
      sending
        ? React.createElement(ActivityIndicator, {
            size: 'small',
            color: accentColor
          })
        : null
    ),
    React.createElement(
      View,
      { style: styles.footer },
      React.createElement(TextInput, {
        style: [styles.input, inputStyle],
        placeholder,
        placeholderTextColor: '#6B7280',
        value: text,
        onChangeText: setText,
        returnKeyType: 'send',
        onSubmitEditing: sendMessage,
        editable: !sending
      }),
      React.createElement(
        TouchableOpacity,
        {
          style: [styles.sendButton, { backgroundColor: accentColor }],
          onPress: sendMessage,
          disabled: sending
        },
        React.createElement(Text, { style: styles.sendButtonText }, buttonText)
      )
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  header: {
    padding: 16,
    justifyContent: 'center'
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18
  },
  messages: {
    flex: 1,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC'
  },
  messagesContent: {
    paddingVertical: 12
  },
  userMessageRow: {
    marginBottom: 12,
    alignItems: 'flex-end'
  },
  assistantMessageRow: {
    marginBottom: 12,
    alignItems: 'flex-start'
  },
  userMessageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%'
  },
  assistantMessageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%'
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF'
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    color: '#111827'
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 12
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});

module.exports = ChatScreen;
