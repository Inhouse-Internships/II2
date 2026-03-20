pipeline {
    agent any

    stages {
        stage('Deploy') {
            steps {
                sh '''
                docker-compose down
                docker-compose up -d --build
                '''
            }
        }
    }
}