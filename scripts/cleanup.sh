# scripts/cleanup.sh
# Cleanup script for removing containers, images, and volumes

set -e

echo "🧹 Cleaning up Crypto Exchange Platform..."

# Stop and remove containers
cleanup_containers() {
    echo "🛑 Stopping and removing containers..."
    docker-compose down --remove-orphans
    
    # Remove any dangling containers
    docker container prune -f
    
    echo "✅ Containers cleaned up"
}

# Remove images
cleanup_images() {
    if [ "$1" = "--images" ] || [ "$1" = "-i" ]; then
        echo "🗑️  Removing images..."
        
        # Remove project images
        docker rmi $(docker images "crypto-exchange*" -q) 2>/dev/null || true
        
        # Remove dangling images
        docker image prune -f
        
        echo "✅ Images cleaned up"
    fi
}

# Remove volumes
cleanup_volumes() {
    if [ "$1" = "--volumes" ] || [ "$1" = "-v" ] || [ "$2" = "--volumes" ] || [ "$2" = "-v" ]; then
        echo "⚠️  This will delete all database data!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🗑️  Removing volumes..."
            docker volume rm $(docker volume ls -q --filter name=crypto-exchange) 2>/dev/null || true
            docker volume prune -f
            echo "✅ Volumes cleaned up"
        else
            echo "📦 Volumes preserved"
        fi
    fi
}

# System cleanup
cleanup_system() {
    if [ "$1" = "--system" ] || [ "$1" = "-s" ]; then
        echo "🧹 Running system cleanup..."
        docker system prune -f
        echo "✅ System cleanup completed"
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -i, --images    Remove Docker images"
    echo "  -v, --volumes   Remove Docker volumes (deletes data!)"
    echo "  -s, --system    Run Docker system cleanup"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Basic cleanup (containers only)"
    echo "  $0 --images           # Cleanup containers and images"
    echo "  $0 --volumes          # Cleanup containers and volumes"
    echo "  $0 --images --volumes # Full cleanup (everything)"
}

# Main execution
main() {
    case "$1" in
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            cleanup_containers
            cleanup_images "$1" "$2"
            cleanup_volumes "$1" "$2"
            cleanup_system "$1"
            echo ""
            echo "🎉 Cleanup completed!"
            ;;
    esac
}

main "$@"