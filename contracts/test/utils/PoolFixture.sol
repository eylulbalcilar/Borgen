// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockStablecoin} from "../../src/MockStablecoin.sol";
import {CollateralNFT} from "../../src/CollateralNFT.sol";
import {LendingPool} from "../../src/LendingPool.sol";

// Shared deployment for the pool tests. The test contract holds every role, so
// individual tests can prank a stranger to check that a role is enforced.
abstract contract PoolFixture is Test {
    MockStablecoin internal token;
    CollateralNFT internal nft;
    LendingPool internal pool;

    uint16 internal constant GENERAL = 0;

    uint256 private _neuroNonce;

    function _deploy() internal {
        token = new MockStablecoin();
        nft = new CollateralNFT(address(this));
        nft.grantRole(nft.MINTER_ROLE(), address(this));
        nft.grantRole(nft.VALUER_ROLE(), address(this));
        nft.grantRole(nft.COMPLIANCE_ROLE(), address(this));

        pool = new LendingPool(token, nft, address(this));
        pool.grantRole(pool.RISK_ROLE(), address(this));
        pool.grantRole(pool.PAUSER_ROLE(), address(this));
        pool.grantRole(pool.TREASURY_ROLE(), address(this));

        nft.setTransferAllowed(address(pool), true);
        pool.setAssetClass(GENERAL, _generalClass());
    }

    function _generalClass() internal pure returns (LendingPool.AssetClass memory) {
        return LendingPool.AssetClass({
            enabled: true,
            ltvBps: 5_000,
            liquidationThresholdBps: 8_000,
            interestRateBps: 1_000,
            auctionStartBps: 10_000,
            auctionFloorBps: 5_000,
            loanDuration: 30 days,
            maxValuationAge: 90 days,
            auctionDuration: 7 days
        });
    }

    // Every mint and revaluation needs a signed contract id that was never used.
    function _neuroId() internal returns (string memory) {
        return string.concat("contract-", vm.toString(++_neuroNonce), "@legal.example");
    }

    function _verify(address account) internal {
        nft.setTransferAllowed(account, true);
    }

    function _mintTo(address owner, uint256 valuation, uint16 assetClass) internal returns (uint256 tokenId) {
        _verify(owner);
        tokenId = nft.mint(owner, _neuroId(), valuation, assetClass);
        vm.prank(owner);
        nft.approve(address(pool), tokenId);
    }

    function _revalue(uint256 tokenId, uint256 valuation) internal {
        nft.updateValuation(tokenId, valuation, _neuroId());
    }

    function _fund(address user, uint256 amount) internal {
        token.mint(user, amount);
        vm.prank(user);
        token.approve(address(pool), type(uint256).max);
    }

    function _interest(uint256 principal, uint256 rateBps, uint256 elapsed) internal pure returns (uint256) {
        return (principal * rateBps * elapsed) / (10_000 * 365 days);
    }

    // Tokens the pool holds must always be fully explained by its own books.
    function _assertBooksMatchBalance() internal view {
        assertEq(
            token.balanceOf(address(pool)),
            pool.cash() + pool.reserveFund() + pool.protocolFees() + pool.totalClaimable(),
            "pool balance does not match its books"
        );
    }
}
