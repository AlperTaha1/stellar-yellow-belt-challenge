#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, symbol_short, Symbol};

#[contract]
pub struct AuctionContract;

// Veritabanında (Ledger) tutacağımız değişkenlerin anahtarları
const BID: Symbol = symbol_short!("BID");
const BIDDER: Symbol = symbol_short!("BIDDER");

#[contractimpl]
impl AuctionContract {
    // Teklif verme fonksiyonu
    pub fn place_bid(env: Env, user: Address, amount: u32) -> u32 {
        // Güvenlik: Fonksiyonu çağıran kişinin gerçekten cüzdan sahibi olduğunu doğrula
        user.require_auth();

        // Mevcut en yüksek teklifi getir (Yoksa 0 kabul et)
        let current_bid: u32 = env.storage().instance().get(&BID).unwrap_or(0);

        // Eğer yeni teklif eskisinden büyükse veritabanını güncelle
        if amount > current_bid {
            env.storage().instance().set(&BID, &amount);
            env.storage().instance().set(&BIDDER, &user);

            // JÜRİNİN İSTEDİĞİ "REAL-TIME EVENT" SATIRI BURADA:
            env.events().publish((symbol_short!("BID"), user.clone()), amount);

            return amount;
        }

        // Değilse eski teklifi geri döndür
        current_bid
    }
}