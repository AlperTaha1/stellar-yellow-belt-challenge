#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, symbol_short, Symbol};

#[contract]
pub struct AuctionContract;

const BID: Symbol = symbol_short!("BID");
const BIDDER: Symbol = symbol_short!("BIDDER");

#[contractimpl]
impl AuctionContract {
    pub fn place_bid(env: Env, user: Address, amount: u32) -> u32 {
        user.require_auth();

        let current_bid: u32 = env.storage().instance().get(&BID).unwrap_or(0);

        if amount > current_bid {
            env.storage().instance().set(&BID, &amount);
            env.storage().instance().set(&BIDDER, &user);

            env.events().publish((symbol_short!("BID"), user.clone()), amount);

            return amount;
        }
        current_bid
    }
}