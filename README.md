# Borgen

RWA-backed lending protocol.

## Overview

Borgen lets owners of real-world assets borrow against them on-chain.

1. A verified appraiser signs the asset's valuation on Neuro.
2. The asset is represented on-chain as an NFT, linked to the Neuro contract ID.
3. The borrower deposits the NFT as collateral and borrows up to a fixed loan-to-value ratio.
4. When the loan is repaid with interest, the NFT is returned to the borrower.
5. If the loan is not repaid or the collateral value drops below the threshold, the position is liquidated and the NFT is transferred to the lenders.

## Architecture

- **Neuro:** legal identities, signed valuation contracts, optional payments (Neuro-Pay / eDaler)
- **Smart contracts:** Solidity + Foundry, deployed on Base Sepolia (collateral NFT, mock stablecoin, lending contract)
- **Backend:** Express + TypeScript + MongoDB, acts as the API and as the relayer between Neuro and the blockchain
- **Frontend:** Next.js + TypeScript + wagmi + viem + RainbowKit

## Roles

- **Borrower:** deposits collateral and takes a loan
- **Appraiser:** verified organisation that signs asset valuations
- **Lender:** provides liquidity to the lending pool

## Project Structure

- `contracts/`: Solidity smart contracts (Foundry)
- `backend/`: Express API and relayer
- `frontend/`: Next.js app (coming soon)

## Status

Work in progress.
