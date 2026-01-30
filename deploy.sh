#!/bin/bash

# 医学宝典 Docker 部署脚本
# 使用方法: ./deploy.sh [start|stop|restart|logs|clean]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_info "Docker 环境检查通过"
}

# 启动服务
start() {
    log_info "正在启动医学宝典服务..."
    
    # 构建并启动容器
    docker-compose up -d --build
    
    log_info "服务启动成功！"
    log_info ""
    log_info "访问地址："
    log_info "  前端: http://localhost"
    log_info "  后端: http://localhost:3000"
    log_info "  API文档: http://localhost:3000/api-docs"
    log_info "  MySQL: localhost:3306"
    log_info "  Redis: localhost:6379"
    log_info ""
    log_info "查看日志: ./deploy.sh logs"
}

# 停止服务
stop() {
    log_info "正在停止服务..."
    docker-compose down
    log_info "服务已停止"
}

# 重启服务
restart() {
    log_info "正在重启服务..."
    stop
    start
}

# 查看日志
logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$SERVICE"
    fi
}

# 查看服务状态
status() {
    log_info "服务运行状态："
    docker-compose ps
}

# 清理数据
clean() {
    log_warn "此操作将删除所有容器、镜像和数据卷，是否继续？(y/n)"
    read -r CONFIRM
    
    if [ "$CONFIRM" != "y" ]; then
        log_info "已取消清理操作"
        exit 0
    fi
    
    log_info "正在清理数据..."
    docker-compose down -v --rmi all
    log_info "清理完成"
}

# 数据库备份
backup_db() {
    BACKUP_DIR="./backups"
    BACKUP_FILE="medical_bible_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p "$BACKUP_DIR"
    
    log_info "正在备份数据库..."
    docker exec medical_bible_mysql mysqldump \
        -uroot -proot123456 \
        medical_bible > "$BACKUP_DIR/$BACKUP_FILE"
    
    log_info "数据库备份完成: $BACKUP_DIR/$BACKUP_FILE"
}

# 数据库恢复
restore_db() {
    BACKUP_FILE=$1
    
    if [ -z "$BACKUP_FILE" ]; then
        log_error "请指定备份文件路径"
        log_info "用法: ./deploy.sh restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
    
    log_warn "此操作将覆盖当前数据库，是否继续？(y/n)"
    read -r CONFIRM
    
    if [ "$CONFIRM" != "y" ]; then
        log_info "已取消恢复操作"
        exit 0
    fi
    
    log_info "正在恢复数据库..."
    docker exec -i medical_bible_mysql mysql \
        -uroot -proot123456 \
        medical_bible < "$BACKUP_FILE"
    
    log_info "数据库恢复完成"
}

# 进入容器
exec_container() {
    SERVICE=$1
    
    if [ -z "$SERVICE" ]; then
        log_error "请指定服务名称"
        log_info "可用服务: mysql, redis, backend, frontend"
        exit 1
    fi
    
    case $SERVICE in
        mysql)
            docker exec -it medical_bible_mysql mysql -uroot -proot123456 medical_bible
            ;;
        redis)
            docker exec -it medical_bible_redis redis-cli
            ;;
        backend)
            docker exec -it medical_bible_backend sh
            ;;
        frontend)
            docker exec -it medical_bible_frontend sh
            ;;
        *)
            log_error "未知的服务: $SERVICE"
            exit 1
            ;;
    esac
}

# 显示帮助信息
show_help() {
    cat << EOF
医学宝典 Docker 部署脚本

用法: ./deploy.sh [命令] [参数]

命令:
  start           启动所有服务
  stop            停止所有服务
  restart         重启所有服务
  logs [service]  查看日志（可选指定服务名）
  status          查看服务状态
  clean           清理所有数据（危险操作）
  backup          备份数据库
  restore <file>  恢复数据库
  exec <service>  进入容器（mysql|redis|backend|frontend）
  help            显示此帮助信息

示例:
  ./deploy.sh start                    # 启动服务
  ./deploy.sh logs backend             # 查看后端日志
  ./deploy.sh backup                   # 备份数据库
  ./deploy.sh restore backup.sql       # 恢复数据库
  ./deploy.sh exec mysql               # 进入 MySQL 容器

EOF
}

# 主函数
main() {
    check_docker
    
    case $1 in
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        logs)
            logs "$2"
            ;;
        status)
            status
            ;;
        clean)
            clean
            ;;
        backup)
            backup_db
            ;;
        restore)
            restore_db "$2"
            ;;
        exec)
            exec_container "$2"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
