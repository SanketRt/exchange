# scripts/deploy.sh

set -e

echo "🚀 Starting Crypto Exchange Platform Deployment..."

# Check if Docker and Docker Compose are installed
check_dependencies() {
    echo "📋 Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    echo "✅ Dependencies check passed"
}

# Build and start services
deploy_services() {
    echo "🔨 Building and starting services..."
    
    # Stop any running containers
    docker-compose down
    
    # Build images
    docker-compose build --no-cache
    
    # Start services
    docker-compose up -d
    
    echo "⏳ Waiting for services to be healthy..."
    
    # Wait for services to be healthy
    timeout=300
    elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if docker-compose ps | grep -q "healthy"; then
            echo "✅ Services are healthy"
            break
        fi
        
        echo "⏳ Waiting for services... ($elapsed/$timeout seconds)"
        sleep 10
        elapsed=$((elapsed + 10))
    done
    
    if [ $elapsed -ge $timeout ]; then
        echo "❌ Services failed to become healthy within $timeout seconds"
        docker-compose logs
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."
    
    # Check backend health
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy"
    else
        echo "❌ Backend health check failed"
        exit 1
    fi
    
    # Check frontend
    if curl -f http://localhost:8080 > /dev/null 2>&1; then
        echo "✅ Frontend is accessible"
    else
        echo "❌ Frontend accessibility check failed"
        exit 1
    fi
    
    # Check database connectivity
    if docker-compose exec -T timescaledb pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ Database is ready"
    else
        echo "❌ Database connectivity check failed"
        exit 1
    fi
    
    # Check Redis connectivity
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is ready"
    else
        echo "❌ Redis connectivity check failed"
        exit 1
    fi
}

# Show deployment status
show_status() {
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Service URLs:"
    echo "   Frontend: http://localhost:8080"
    echo "   Backend API: http://localhost:3000"
    echo "   Health Check: http://localhost:3000/health"
    echo ""
    echo "🔧 Management Commands:"
    echo "   View logs: docker-compose logs -f"
    echo "   Stop services: docker-compose down"
    echo "   Restart services: docker-compose restart"
    echo "   View status: docker-compose ps"
    echo ""
    echo "📈 Database Access:"
    echo "   TimescaleDB: localhost:5432 (postgres/postgres)"
    echo "   Redis: localhost:6379"
    echo ""
}

# Main execution
main() {
    check_dependencies
    deploy_services
    verify_deployment
    show_status
}

# Run with error handling
main "$@" || {
    echo ""
    echo "❌ Deployment failed. Checking logs..."
    docker-compose logs --tail=50
    exit 1
}