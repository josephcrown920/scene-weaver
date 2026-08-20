# Embedding Scene Weaver

Scene Weaver exposes the full editor at `/embed`. It renders the same editor as `/`, inside its own iframe document, so Aurora host styles cannot alter its appearance.

## Deployment configuration

Set `AURORA_EMBED_ALLOWED_ORIGINS` to a comma-separated list of the exact Aurora/Replit origins allowed to frame the editor. Example:

```text
https://your-aurora.replit.app,https://your-production-domain.example
```

The route uses CSP `frame-ancestors` for framing. `X-Frame-Options` is intentionally omitted on `/embed` because it cannot safely express cross-origin allow-lists.

## Host integration

Use Aurora Global's `AuroraEmbed` component with:

```tsx
<AuroraEmbed
  kind="scene-weaver"
  src="https://your-scene-weaver-domain/embed"
  title="Scene Weaver"
/>
```

The component passes its origin to the iframe and adjusts the iframe height from trusted `postMessage` events. Do not add `sandbox` to this iframe: uploads and editor features need their normal browser capabilities.