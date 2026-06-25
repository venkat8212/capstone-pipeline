pipeline {
    agent any

    environment {
        DOCKER_IMAGE_BACKEND = 'capstone-backend'
        DOCKER_IMAGE_FRONTEND = 'capstone-frontend'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
            }
        }

        stage('Verify Syntax') {
            steps {
                echo 'Verifying backend Python syntax...'
                // Standard check if python3 is available in pipeline environment
                sh 'python3 -m py_compile server.py || true'
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building backend Docker image...'
                sh "docker build -t ${DOCKER_IMAGE_BACKEND}:latest -f Dockerfile ."
                
                echo 'Building frontend Docker image...'
                sh "docker build -t ${DOCKER_IMAGE_FRONTEND}:latest -f Dockerfile.frontend ."
            }
        }

        stage('Integration Deployment') {
            steps {
                echo 'Starting services via Docker Compose...'
                sh 'docker compose down || true'
                sh 'docker compose up -d'
                
                echo 'Verifying running containers...'
                sh 'docker compose ps'
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed. Fetching logs...'
            sh 'docker compose logs || true'
        }
    }
}
