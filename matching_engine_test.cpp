#include "matching_engine.h"
#include <cassert>
#include <iostream>
#include <tuple>

int main() {
    // Test 1: No match -> no trades
    {
        MatchingEngine me;
        Order o1{1, Side::BUY, 100.0, 10, 1};
        auto trades = me.addOrder(o1);
        assert(trades.empty());
    }

    // Test 2: Simple match BUY then SELL
    {
        MatchingEngine me;
        Order b1{1, Side::BUY, 100.0, 10, 1};
        me.addOrder(b1);
        Order s1{2, Side::SELL, 100.0, 10, 2};
        auto trades = me.addOrder(s1);
        assert(trades.size() == 1);
        auto [incomingId, existingId, price, qty] = trades[0];
        assert(incomingId == 2);
        assert(existingId == 1);
        assert(price == 100.0);
        assert(qty == 10);
    }

    // Test 3: Partial fills and multiple matches
    {
        MatchingEngine me;
        Order b2{1, Side::BUY, 100.0, 15, 1};
        me.addOrder(b2);
        Order s2{2, Side::SELL, 100.0, 5,  2};
        auto t2 = me.addOrder(s2);
        assert(t2.size() == 1);
        assert(std::get<3>(t2[0]) == 5);

        Order s3{3, Side::SELL, 100.0, 10, 3};
        auto t3 = me.addOrder(s3);
        assert(t3.size() == 1);
        assert(std::get<3>(t3[0]) == 10);
    }

    // Test 4: Cancel order
    {
        MatchingEngine me;
        Order b4{4, Side::BUY, 200.0, 20, 4};
        me.addOrder(b4);
        assert(me.cancelOrder(4) == true);

        // After cancellation, matching SELL produces no trades
        Order s4{5, Side::SELL, 200.0, 20, 5};
        auto t4 = me.addOrder(s4);
        assert(t4.empty());
        assert(me.cancelOrder(4) == false);
    }

    std::cout << "All MatchingEngine tests passed!\n";
    return 0;
}
