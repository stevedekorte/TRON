# Bit — ENCOM TERMINAL program

Copied from dekorte.com/fun/visuals/bit, originally by ControllingTransmission
for GDC 2018. The MIT license is retained in LICENSE. Original local Three.js,
OBJ assets, animation code and yes/no sound clips are retained.

Select BIT in the terminal. Existing microphone permission starts Bit automatically; otherwise the blinking activation prompt waits for a click/tap or Enter and permission approval.
Escape returns to program selection and unloads the renderer, audio and microphone.
Speech recognition requires browser support and may require a network connection.

Integration changes: shared fonts/logo, centered terminal text, Escape cleanup,
plain-text speech rendering, and the host's budgeted Jev relay for answers.
No browser API key storage, standalone server, TLS keys, nested service worker,
or separate PWA is included. The host PWA caches Bit's static assets.

The public Jev worker must include the shared Bit request protocol to answer
questions after deployment. Local Vite uses the same protocol automatically.
