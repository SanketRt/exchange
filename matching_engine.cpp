#include "matching_engine.h"
#include <algorithm>

std::vector<std::tuple<OrderId,OrderId,double,uint64_t>>
MatchingEngine::addOrder(const Order& order) {
    std::vector<std::tuple<OrderId,OrderId,double,uint64_t>> trades;
    Order incoming = order;

    // 1) match against the opposite book
    if (incoming.side == Side::BUY)      matchOrder(incoming, asks, trades);
    else                                 matchOrder(incoming, bids, trades);

    // 2) any leftover quantity goes into our own book
    if (incoming.quantity > 0) {
        if (incoming.side == Side::BUY) {
            auto& level = bids[incoming.price];
            level.push_back(incoming);
            orderIndex[incoming.id] = { incoming.side, incoming.price, level.size()-1 };
        } else {
            auto& level = asks[incoming.price];
            level.push_back(incoming);
            orderIndex[incoming.id] = { incoming.side, incoming.price, level.size()-1 };
        }
    }

    return trades;
}


bool MatchingEngine::cancelOrder(OrderId orderId) {
    auto it = orderIndex.find(orderId);
    if (it == orderIndex.end()) return false;

    // Pull out the stored side & price
    BookEntry entry = it->second;

    // Choose the right book
    if (entry.side == Side::BUY) {
        auto& book = bids;
        auto lvlIt = book.find(entry.price);
        if (lvlIt != book.end()) {
            auto& level = lvlIt->second;
            size_t idx = entry.index;
            if (idx < level.size()) {
                level.erase(level.begin() + idx);
                // Re-index the remaining orders
                for (size_t i = idx; i < level.size(); ++i) {
                    orderIndex[level[i].id].index = i;
                }
            }
            if (level.empty()) {
                book.erase(lvlIt);
            }
        }
    } else {
        auto& book = asks;
        auto lvlIt = book.find(entry.price);
        if (lvlIt != book.end()) {
            auto& level = lvlIt->second;
            size_t idx = entry.index;
            if (idx < level.size()) {
                level.erase(level.begin() + idx);
                // Re-index the remaining orders
                for (size_t i = idx; i < level.size(); ++i) {
                    orderIndex[level[i].id].index = i;
                }
            }
            if (level.empty()) {
                book.erase(lvlIt);
            }
        }
    }

    // Finally remove from our lookup
    orderIndex.erase(it);
    return true;
}


// Match routine for SELL orders vs. bids (greater comparator)
void MatchingEngine::matchOrder(Order incoming,
    std::map<double, PriceLevel<Order>, std::greater<>>& book,
    std::vector<std::tuple<OrderId, OrderId, double, uint64_t>>& trades) {

    auto it = book.begin();
    while (it != book.end() && incoming.quantity > 0) {
        double bookPrice = it->first;
        // Check crossing: SELL price <= best bid
        if (!(incoming.side == Side::SELL && incoming.price <= bookPrice)) break;

        auto& level = it->second;
        // Execute against orders at this price level
        while (!level.empty() && incoming.quantity > 0) {
            Order& top = level.front();
            uint64_t executed = std::min(incoming.quantity, top.quantity);
            incoming.quantity -= executed;
            top.quantity -= executed;
            trades.emplace_back(incoming.id, top.id, bookPrice, executed);

            // Remove filled orders
            if (top.quantity == 0) {
                orderIndex.erase(top.id);
                level.pop_front();
                // Update indices of remaining
                for (size_t i = 0; i < level.size(); ++i) {
                    orderIndex[level[i].id].index = i;
                }
            }
        }

        // Erase price level if empty
        if (level.empty()) {
            it = book.erase(it);
        } else {
            break; // Cannot match more at this level
        }
    }
}

// Match routine for BUY orders vs. asks (less comparator)
void MatchingEngine::matchOrder(Order incoming,
    std::map<double, PriceLevel<Order>, std::less<>>& book,
    std::vector<std::tuple<OrderId, OrderId, double, uint64_t>>& trades) {

    auto it = book.begin();
    while (it != book.end() && incoming.quantity > 0) {
        double bookPrice = it->first;
        // Check crossing: BUY price >= best ask
        if (!(incoming.side == Side::BUY && incoming.price >= bookPrice)) break;

        auto& level = it->second;
        // Execute against orders at this price level
        while (!level.empty() && incoming.quantity > 0) {
            Order& top = level.front();
            uint64_t executed = std::min(incoming.quantity, top.quantity);
            incoming.quantity -= executed;
            top.quantity -= executed;
            trades.emplace_back(incoming.id, top.id, bookPrice, executed);

            // Remove filled orders
            if (top.quantity == 0) {
                orderIndex.erase(top.id);
                level.pop_front();
                // Update indices of remaining
                for (size_t i = 0; i < level.size(); ++i) {
                    orderIndex[level[i].id].index = i;
                }
            }
        }

        // Erase price level if empty
        if (level.empty()) {
            it = book.erase(it);
        } else {
            break; // Cannot match more at this level
        }
    }
}
