// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";

contract MockStablecoinTest is Test {
    MockStablecoin internal token;
    address internal user = makeAddr("user");

    function setUp() public {
        token = new MockStablecoin();
    }

    function test_Decimals() public view {
        assertEq(token.decimals(), 6);
    }

    function test_Mint() public {
        token.mint(user, 1_000e6);

        assertEq(token.balanceOf(user), 1_000e6);
        assertEq(token.totalSupply(), 1_000e6);
    }
}
