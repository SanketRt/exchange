# scripts/dev.sh
# Development environment setup script

set -e

echo "🛠️  Setting up Development Environment..."

# Start only essential services for development
start_dev_services() {
    echo "🚀 Starting development services..."
    
    # Start only database and Redis for development
    docker-compose up -d redis timescaledb
    
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Wait for database to be ready
    until docker-compose exec -T timescaledb pg_isready -U postgres; do
        echo "⏳ Waiting for database..."
        sleep 2
    done
    
    # Wait for Redis to be ready
    until docker-compose exec -T redis redis-cli ping; do
        echo "⏳ Waiting for Redis..."
        sleep 2
    done
    
    echo "✅ Development services are ready"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    # Backend dependencies
    if [ -d "crypto-exchange-backend" ]; then
        echo "📦 Installing backend dependencies..."
        cd crypto-exchange-backend
        npm install
        cd ..
    fi
    
    # Frontend dependencies
    if [ -d "client" ]; then
        echo "📦 Installing frontend dependencies..."
        cd client
        npm install
        cd ..
    fi
    
    echo "✅ Dependencies installed"
}

# Show development instructions
show_dev_instructions() {
    echo ""
    echo "🛠️  Development Environment Ready!"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Start the backend:"
    echo "      cd crypto-exchange-backend && npm run dev"
    echo ""
    echo "   2. Start the frontend (in another terminal):"
    echo "      cd client && npm start"
    echo ""
    echo "🔗 URLs:"
    echo "   Frontend: http://localhost:3001"
    echo "   Backend: http://localhost:3000"
    echo ""
    echo "💾 Database Connections:"
    echo "   TimescaleDB: postgresql://postgres:postgres@localhost:5432/crypto_exchange"
    echo "   Redis: redis://localhost:6379"
    echo ""
    echo "🛑 To stop development services:"
    echo "   docker-compose down"
    echo ""
}

# Main execution
main() {
    start_dev_services
    install_dependencies
    show_dev_instructions
}

main "$@"