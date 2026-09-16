// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";
import {LendingPool} from "../src/LendingPool.sol";

contract Deploy is Script {
    function run() external returns (MockStablecoin token, CollateralNFT nft, LendingPool pool) {
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        token = new MockStablecoin();
        nft = new CollateralNFT(deployer);
        pool = new LendingPool(token, nft);
        nft.grantRole(nft.MINTER_ROLE(), relayer);

        vm.stopBroadcast();

        console.log("MockStablecoin:", address(token));
        console.log("CollateralNFT: ", address(nft));
        console.log("LendingPool:   ", address(pool));
        console.log("Deployer:      ", deployer);
        console.log("Relayer:       ", relayer);
    }
}
