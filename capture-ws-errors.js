// Copy and paste this into your browser console
// Then refresh the page to capture WebSocket errors

(function() {
  console.log('🎯 Installing WebSocket error capture...');

  const OriginalWebSocket = window.WebSocket;
  const errors = [];

  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);

    ws.addEventListener('message', function(event) {
      try {
        const data = JSON.parse(event.data);

        // Check if this is an error message
        const isError =
          data.event === 'phx_error' ||
          (data.event === 'phx_reply' && data.payload?.status === 'error') ||
          (data.payload?.response?.error);

        if (isError) {
          const errorInfo = {
            timestamp: new Date().toISOString(),
            event: data.event,
            topic: data.topic,
            ref: data.ref,
            payload: data.payload,
            fullMessage: data
          };

          errors.push(errorInfo);

          console.error('🚨 WebSocket ERROR CAPTURED:');
          console.error('Topic:', data.topic);
          console.error('Event:', data.event);
          console.error('Payload:', JSON.stringify(data.payload, null, 2));
          console.error('Full message:', JSON.stringify(data, null, 2));
        }

        // Log all realtime messages for debugging
        if (url.includes('realtime')) {
          const prefix = isError ? '❌' : data.event === 'phx_reply' && data.payload?.status === 'ok' ? '✅' : '📨';
          console.log(`${prefix} [${data.event}] ${data.topic || ''}`, data.payload);
        }
      } catch (e) {
        // Not JSON
      }
    });

    return ws;
  };

  // Preserve constants
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  window._wsErrors = errors;

  console.log('✅ WebSocket monitor installed');
  console.log('💡 Now REFRESH the page to capture errors');
  console.log('💡 Errors will be logged above with 🚨');
  console.log('💡 Access captured errors: window._wsErrors');
})();
