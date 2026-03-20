pipeline {
    agent any

    environment {
        // Use environment variables for secrets if needed
        JWT_SECRET = 'supersecretkey123'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Frontend') {
            steps {
                echo 'Installing dependencies and building frontend...'
                // Using the root package.json scripts
                sh 'npm install --prefix frontend'
                sh 'npm run build --prefix frontend'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Starting deployment with Docker Compose...'
                sh '''
                docker-compose -f docker-compose.yml down --remove-orphans
                docker-compose -f docker-compose.yml up -d --build
                '''
            }
        }
    }
}