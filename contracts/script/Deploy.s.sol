// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";
import {LendingPool} from "../src/LendingPool.sol";

// RELAYER_ADDRESS is required. Every other key defaults to it, which is fine
// on a testnet. For anything holding real value give each role its own key and
// set ADMIN_ADDRESS to a multisig:
//   ADMIN_ADDRESS       owns both contracts and hands out roles
//   VALUER_ADDRESS      updates valuations
//   COMPLIANCE_ADDRESS  decides which wallets may hold collateral
//   RISK_ADDRESS        sets asset classes and fees
//   GUARDIAN_ADDRESS    can pause the pool
//   TREASURY_ADDRESS    collects protocol fees
contract Deploy is Script {
    uint16 internal constant GENERAL_CLASS = 0;

    struct Roles {
        address admin;
        address relayer;
        address valuer;
        address compliance;
        address risk;
        address guardian;
        address treasury;
    }

    function run() external returns (MockStablecoin token, CollateralNFT nft, LendingPool pool) {
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        Roles memory roles = Roles({
            admin: admin,
            relayer: relayer,
            valuer: vm.envOr("VALUER_ADDRESS", relayer),
            compliance: vm.envOr("COMPLIANCE_ADDRESS", relayer),
            risk: vm.envOr("RISK_ADDRESS", admin),
            guardian: vm.envOr("GUARDIAN_ADDRESS", admin),
            treasury: vm.envOr("TREASURY_ADDRESS", admin)
        });

        (token, nft, pool) = deploy(roles, deployer);
        vm.stopBroadcast();

        console.log("MockStablecoin:", address(token));
        console.log("CollateralNFT: ", address(nft));
        console.log("LendingPool:   ", address(pool));
        console.log("Deployer:      ", deployer);
        console.log("Admin:         ", admin);
        console.log("Relayer:       ", relayer);
    }

    // deployer is the account sending these calls. It holds admin rights only
    // for the length of the setup.
    function deploy(Roles memory roles, address deployer)
        public
        returns (MockStablecoin token, CollateralNFT nft, LendingPool pool)
    {
        token = new MockStablecoin();
        nft = new CollateralNFT(deployer);
        pool = new LendingPool(token, nft, deployer);

        nft.grantRole(nft.MINTER_ROLE(), roles.relayer);
        nft.grantRole(nft.VALUER_ROLE(), roles.valuer);

        // The pool holds collateral in escrow, so it has to be an allowed holder.
        nft.grantRole(nft.COMPLIANCE_ROLE(), deployer);
        nft.setTransferAllowed(address(pool), true);
        nft.renounceRole(nft.COMPLIANCE_ROLE(), deployer);
        nft.grantRole(nft.COMPLIANCE_ROLE(), roles.compliance);

        // Starting terms. These are placeholders that match the first version of
        // the pool, not a risk policy: review them before real money is involved.
        pool.grantRole(pool.RISK_ROLE(), deployer);
        pool.setAssetClass(
            GENERAL_CLASS,
            LendingPool.AssetClass({
                enabled: true,
                ltvBps: 5_000,
                liquidationThresholdBps: 8_000,
                interestRateBps: 1_000,
                auctionStartBps: 10_000,
                auctionFloorBps: 5_000,
                loanDuration: 30 days,
                maxValuationAge: 180 days,
                auctionDuration: 7 days
            })
        );
        pool.setInterestSplit(1_000, 1_000);
        pool.setKeeperFeeBps(50);
        pool.renounceRole(pool.RISK_ROLE(), deployer);

        pool.grantRole(pool.RISK_ROLE(), roles.risk);
        pool.grantRole(pool.PAUSER_ROLE(), roles.guardian);
        pool.grantRole(pool.TREASURY_ROLE(), roles.treasury);

        // Hand ownership over last, so the deployer key keeps no power.
        if (roles.admin != deployer) {
            nft.grantRole(nft.DEFAULT_ADMIN_ROLE(), roles.admin);
            pool.grantRole(pool.DEFAULT_ADMIN_ROLE(), roles.admin);
            nft.renounceRole(nft.DEFAULT_ADMIN_ROLE(), deployer);
            pool.renounceRole(pool.DEFAULT_ADMIN_ROLE(), deployer);
        }
    }
}
