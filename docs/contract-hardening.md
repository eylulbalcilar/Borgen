# Contract hardening

This describes the second version of the Borgen contracts: what changed, why, and
what the app has to change before these contracts can replace the ones that are
live on Base Sepolia.

Nothing here is deployed. The live app still talks to the first version.

## What changed

### Collateral token (`CollateralNFT`)

| Weakness in the first version | What the contract does now |
| --- | --- |
| One key could mint collateral and also rewrite its value. | Three roles on three keys: `MINTER_ROLE` creates collateral, `VALUER_ROLE` updates its value, `COMPLIANCE_ROLE` decides which wallets may hold it. |
| A valuation update needed no evidence. The relayer could write any number. | `updateValuation` requires the id of a signed contract that has never been used, the same rule as minting. Every value on chain points to its own signed appraisal. |
| The token could be sent to any wallet. | The token can only arrive at an address that compliance has approved. This covers minting, escrow, return after repayment and purchase in a liquidation. |
| Every asset had the same terms. | Each token carries an asset class, set at mint. The pool keeps separate terms per class. |

### Lending pool (`LendingPool`)

| Weakness in the first version | What the contract does now |
| --- | --- |
| A loan could be taken against a valuation of any age. | Each asset class has a maximum valuation age. `borrow` and `renew` reject an appraisal older than that. |
| The liquidator paid the debt and kept the whole asset, even when it was worth twice the debt. | Liquidation is a descending-price auction. The sale pays the debt, and everything above it is credited to the borrower. |
| Nobody had a reason to liquidate collateral worth less than the debt. | The buyer pays the auction price, not the debt, so an underwater asset still sells. Whoever opens the auction earns a small share of the sale. |
| A loss fell straight on lenders. | A reserve fund, filled from a share of interest, takes the first loss. Lenders only carry what it cannot cover. |
| The first depositor could inflate the share price and round later deposits down to nothing. | The pool tracks its own cash instead of reading its token balance, so tokens sent directly to it change nothing. Share maths also includes one virtual share. |
| Interest only counted once a loan was repaid. A lender who left early gave their interest to the others. | Interest is counted as it accrues. `totalAssets` includes it at all times, at constant cost regardless of how many loans are open. |
| One fixed loan-to-value ratio, rate and term for everything. | Terms are set per asset class: loan-to-value, liquidation threshold, rate, term, valuation age and auction shape. A running loan keeps the rate it started with. |
| A loan could only be repaid in full, on one fixed term. | `repayPartial` pays down interest, then principal. `renew` starts a new term once the interest so far is paid and the loan passes the checks of a new one. |
| The platform earned nothing. | A share of paid interest goes to the protocol and is collected by the treasury key. |
| No way to stop the pool if something went wrong. | A guardian key can pause deposits, new loans, renewals and new auctions. Repaying, withdrawing, claiming and buying in a running auction always stay open, so nobody is locked in. Only the admin can resume. |
| One key controlled everything. | Admin, risk parameters, pausing and fee collection are separate roles. The deploy script hands admin to a separate address, meant to be a multisig, and leaves the deployer with nothing. |

## How liquidation works now

1. A loan becomes liquidatable when it is past its due date, or when the debt
   exceeds the liquidation threshold of the current valuation.
2. Anyone can call `startAuction`. Interest stops at that moment, so the debt the
   sale has to cover is fixed.
3. The price starts at a percentage of the valuation and falls in a straight line
   to a floor over the auction period. Both percentages and the period come from
   the asset class.
4. The first approved buyer to call `buy` pays the current price and receives the
   token.
5. The price is split in this order: the fee for whoever opened the auction, the
   debt, and then the borrower, who gets everything that is left.
6. If the sale does not cover the principal, the reserve fund pays the gap as far
   as it can. Only the remainder reduces the value of lender shares.
7. Until someone buys, the borrower can still repay the full debt and take the
   asset back.
8. If the price reaches the floor unsold, the auction can be reopened, but only
   against an appraisal made after it began.

The borrower's surplus and the opener's fee are not sent automatically. They are
recorded and collected with `claim`, so a recipient that cannot receive tokens
cannot block a sale.

## Tests

73 tests, all passing.

- Unit tests for every rule above, including each access check.
- Fuzz tests, 1,000 random inputs each: the first depositor cannot take from the
  next one, deposits never profit from a round trip, interest matches the formula,
  partial repayments settle exactly, the auction price only falls, and an auction
  settlement neither creates nor loses a single unit.
- Invariant tests: 64 runs of 250 random actions each across lenders, borrowers, a
  keeper and a buyer. After every action the tests check that the pool's token
  balance equals the sum of its books, shares add up, the running totals match the
  open loans, and collateral is in escrow exactly while a loan is open.
- Each of 15 deliberately introduced bugs, one at a time, makes at least one test
  fail.

Run them from `contracts/`:

```shell
forge test
```

## What the app must change before deploying

The first version's addresses are in `contracts/deployments.json`. A new deployment
gives new addresses and starts with an empty pool and no tokens.

### Backend

- `mint(to, neuroContractId, valuation)` is now
  `mint(to, neuroContractId, valuation, assetClass)`.
- The owner's wallet has to be approved with `setTransferAllowed(owner, true)`
  before minting to it. This needs the compliance key.
- `updateValuation(tokenId, valuation)` is now
  `updateValuation(tokenId, valuation, neuroContractId)`, sent with the valuer key
  and the id of a new signed contract.
- `getAppraisal` returns a fourth field, `assetClass`.
- Events: `AssetMinted` and `ValuationUpdated` each have one more argument.
  `Liquidated` is gone. New events are `AuctionStarted`, `AuctionSettled`,
  `PartiallyRepaid`, `Renewed` and `Claimed`.
- New environment variables if the roles use separate keys.

### Frontend

- `liquidate(tokenId)` is gone. The liquidations page needs `startAuction`,
  `auctionPrice`, `buy(tokenId, maxPrice)` and a way to `claim`.
- The fixed terms (50% loan-to-value, 10% rate, 30 days) are no longer constants.
  Read them with `assetClasses(classId)` or use `maxBorrow(tokenId)`.
- `loans(tokenId)` returns eight fields. The first four are unchanged.
- A buyer in a liquidation has to be an approved address.
- New actions to offer: `repayPartial` and `renew`.
- `deposit`, `withdraw`, `borrow`, `repay`, `debtOf`, `isLiquidatable`,
  `totalAssets`, `totalBorrowed`, `totalShares` and `sharesOf` keep their
  signatures.

## Parameters that still need a decision

The deploy script sets one asset class with the first version's terms and adds
values for the new settings. These are placeholders, not a risk policy.

| Setting | Placeholder |
| --- | --- |
| Loan-to-value, liquidation threshold, rate, term | 50%, 80%, 10% a year, 30 days |
| Maximum valuation age | 180 days |
| Auction start, floor, period | 100% and 50% of valuation, 7 days |
| Protocol share of interest | 10% |
| Reserve share of interest | 10% |
| Fee for opening an auction | 0.5% of the sale price |

## What the contracts still do not solve

- The contracts are not upgradeable. A bug is handled by pausing and moving to a
  new deployment.
- The pause does not stop the clock of an auction that is already running.
- A loss is only recognised when an auction settles. A lender who withdraws just
  before that avoids their part of it.
- If compliance removes a borrower's approval while their loan is open, the token
  cannot be returned to them until the approval is restored.
- The allowlist records that a wallet was approved. The identity check itself
  happens off chain.
- The token is still not a legal claim on the physical asset. Custody, insurance,
  enforcement, licensing and an appraiser network are outside the contracts.
- There has been no external audit.
