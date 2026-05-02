# ODTE Dashboard Todo

- Add a future BookMap-style liquidity sweep panel inside the 0DTE dashboard.
  - Goal: not a full BookMap clone, just a practical sweep warning/read.
  - Research direction: use Schwab/TOS Level I plus any available streaming Level II/book data.
  - Display idea: aggregate bid/ask size by price and flag unusually large liquidity levels as possible sweep magnets.
  - Notes: Schwab says TOS Bookmap uses Nasdaq Level II order-book data; public Schwab API support for Level II is thin, and third-party `schwab-py` notes level-two streams are partly reverse-engineered.
  - Do this after the main 0DTE dashboard is stable.
