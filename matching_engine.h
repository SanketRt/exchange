#pragma once
#include <cstdint>
#include <map>
#include <deque>
#include <unordered_map>
#include <optional>
#include <vector>

// Side of an order: BUY bids, SELL asks
enum class Side { BUY, SELL };

// Basic Order representation
typedef uint64_t OrderId;
struct Order {
    OrderId id;
    Side side;
    double price;
    uint64_t quantity;
    uint64_t timestamp; // for time priority
};

// A price level holds a FIFO queue of orders at the same price
template <typename T>
using PriceLevel = std::deque<T>;

// MatchingEngine: maintains two order books and matches incoming orders
class MatchingEngine {
public:
    // Add a new order; returns vector of trades (orderId, matchedOrderId, price, quantity)
    std::vector<std::tuple<OrderId, OrderId, double, uint64_t>> addOrder(const Order& order);

    // Cancel an existing order by id; returns true if cancelled
    bool cancelOrder(OrderId orderId);

private:
    // Price -> queue of Orders; bids sorted descending, asks ascending
    std::map<double, PriceLevel<Order>, std::greater<>> bids;
    std::map<double, PriceLevel<Order>, std::less<>>    asks;

    // Map orderId to iterator/location for O(1) cancellation
    struct BookEntry { Side side; double price; size_t index; };
    std::unordered_map<OrderId, BookEntry> orderIndex;

    // Internal matching routines
    void matchOrder(Order incoming, std::map<double, PriceLevel<Order>, std::greater<>>& book,
                    std::vector<std::tuple<OrderId, OrderId, double, uint64_t>>& trades);

    void matchOrder(Order incoming, std::map<double, PriceLevel<Order>, std::less<>>& book,
                    std::vector<std::tuple<OrderId, OrderId, double, uint64_t>>& trades);
};
