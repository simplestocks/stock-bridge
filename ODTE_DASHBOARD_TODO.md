# ODTE Dashboard Todo

- Add a future BookMap-style liquidity sweep panel inside the 0DTE dashboard.
  - Goal: not a full BookMap clone, just a practical sweep warning/read.
  - Research direction: use Schwab/TOS Level I plus any available streaming Level II/book data.
  - Display idea: aggregate bid/ask size by price and flag unusually large liquidity levels as possible sweep magnets.
  - Notes: Schwab says TOS Bookmap uses Nasdaq Level II order-book data; public Schwab API support for Level II is thin, and third-party `schwab-py` notes level-two streams are partly reverse-engineered.
  - Do this after the main 0DTE dashboard is stable.

- Revisit Open Trades width experiment.
  - Current left-overlap version from commit `ced2e8f` looks bad.
  - Likely revert the Open Trades `margin-left: -282px`, `width: calc(100% + 282px)`, and `z-index: 2` change.
  - Better next attempt: keep panel aligned and solve space with table column sizing or a cleaner layout move.

- Continue tablet polish on IC/IB box layout.
  - Keep labels short: IC and IB.
  - Keep font sizes consistent inside the box.
  - IC text currently reads larger than IB text; normalize after seeing live use.
  - Keep center/width/entry inputs compact.
  - Recheck fit on tablet-sized viewport after next visual pass.
