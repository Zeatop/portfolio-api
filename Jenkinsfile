pipeline {
    agent any

    environment {
        REGISTRY = '10.0.0.10:5000'
        IMAGE = 'portfolio-api'
        TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Zeatop/portfolio-api.git'
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker build -t ${REGISTRY}/${IMAGE}:${TAG} -t ${REGISTRY}/${IMAGE}:latest ."
            }
        }

        stage('Docker Push') {
            steps {
                sh "docker push ${REGISTRY}/${IMAGE}:${TAG}"
                sh "docker push ${REGISTRY}/${IMAGE}:latest"
            }
        }

        stage('Update K8s Secret') {
            steps {
                withCredentials([
                    string(credentialsId: 'resend-api-key', variable: 'RESEND_API_KEY'),
                    string(credentialsId: 'mail-from',      variable: 'MAIL_FROM'),
                    string(credentialsId: 'mail-to',        variable: 'MAIL_TO'),
                ]) {
                    sh '''
                        kubectl create secret generic portfolio-api-secrets \
                          --from-literal=resend-api-key="$RESEND_API_KEY" \
                          --from-literal=mail-from="$MAIL_FROM" \
                          --from-literal=mail-to="$MAIL_TO" \
                          --dry-run=client -o yaml | kubectl apply -f -
                    '''
                }
            }
        }

        stage('Deploy to K8s') {
            steps {
                sh "sed -i 's|${REGISTRY}/${IMAGE}:latest|${REGISTRY}/${IMAGE}:${TAG}|' k8s/deployment.yaml"
                sh 'kubectl apply -f k8s/deployment.yaml'
                sh 'kubectl rollout status deployment/portfolio-api --timeout=120s'
            }
        }
    }

    post {
        success {
            echo "Déploiement réussi du portfolio-api (tag ${TAG})"
        }
        failure {
            echo "Le pipeline a échoué"
        }
    }
}