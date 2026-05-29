# Brainbox Web SDK

A plain JavaScript SDK and embeddable chat widget for non-React websites.

## What this is for

Use this package when customers do not want React/Next.js/Angular, or when they need a simple copy-paste HTML/CSS/jQuery integration.

It includes:

- `BrainboxWebSDK` — lightweight JS client for `/api/chat`, `/api/chat/session`, `/api/ingest`, and `/api/health`
- `BrainboxWebWidget` — a copy-paste support chat widget that works in plain HTML pages

## Usage

### 1. Add the script

```html
<script src="/path/to/brainbox-web-sdk.js"></script>
```

### 2. Initialize the SDK

```html
<script>
  const sdk = new BrainboxWebSDK(
    'https://api.yourbackend.com',
    'YOUR_API_KEY',
    'tenant-123'
  );
</script>
```

### 3. Create a widget

```html
<script>
  new BrainboxWebWidget({
    sdk,
    position: 'bottom-right',
    primaryColor: '#2563EB',
    accentColor: '#111827',
    buttonText: 'Help',
    placeholder: 'Ask a question...',
    width: '360px',
    height: '520px'
  });
</script>
```

## API endpoints

The web SDK talks to the backend directly over these REST endpoints:

- `POST /api/chat` — send chat requests
- `POST /api/chat/session` — create chat sessions
- `POST /api/ingest` — ingest logs or data
- `GET /api/health` — check backend health
- `POST /api/chat/stream` — stream partial chat responses in real time

## How responses arrive

This SDK uses browser `fetch` to call the API. It does not establish a WebSocket connection by default. When `/api/chat/stream` is available, the UI receives chunks from the backend and updates as they arrive, which gives a faster perceived response. If streaming is unavailable, it falls back to a regular chat response.

## Copy-paste HTML example

Use the widget in any HTML page, Odoo template, or legacy site.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Brainbox Widget</title>
  </head>
  <body>
    <script src="brainbox-web-sdk.js"></script>
    <script>
      const sdk = new BrainboxWebSDK(
        'https://api.yourbackend.com',
        'YOUR_API_KEY',
        'tenant-123'
      );

      new BrainboxWebWidget({
        sdk,
        position: 'bottom-right',
        primaryColor: '#2563EB',
        accentColor: '#111827',
        buttonText: 'Support Chat',
        placeholder: 'Ask anything...'
      });
    </script>
  </body>
</html>
```

## Compatibility

- React / Next.js: the existing React SDK works in client-side React apps and Next.js pages/components when rendered on the client.
- Angular / AngularJS: the React UI components are not compatible, but the underlying API endpoints and this web SDK can be used directly.
- React Native: UI components are not compatible with React Native. The plain SDK client may work if `fetch` or `axios` is available, but native UI components are required for a full RN app.
- Odoo / plain HTML: this SDK is designed to work in any browser environment, including Odoo template pages. In Odoo, add the script tags in your XML/HTML template so the browser loads the widget.

## Deployment

The `sdk-web` package is a client-side browser library. It does not automatically deploy the UI to a hosting provider.

- Host `brainbox-web-sdk.js` as a static asset or include it through your website build.
- Add the `<script>` tag to your HTML page or Odoo XML template.
- Initialize the widget when the page loads.

This package is best for simple web pages, legacy sites, and Odoo pages that render HTML in the browser.

## Notes

- This package is for frontend embedding only.
- It does not store chat history on the page by default.
- It uses your backend API and API key for communication.
