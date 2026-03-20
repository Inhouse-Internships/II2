pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/Inhouse-Internships/II2.git'
            }
        }

        stage('Build & Deploy') {
            steps {
                sh '''
                docker-compose down
                docker-compose up -d --build
                '''
            }
        }
    }
}