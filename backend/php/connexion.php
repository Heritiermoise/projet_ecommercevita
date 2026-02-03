<?php
require_once 'db.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Données invalides']);
    exit;
}

$email = $input['email'] ?? '';
$motDePasse = $input['motDePasse'] ?? '';

if (empty($email) || empty($motDePasse)) {
    http_response_code(400);
    echo json_encode(['error' => 'Email et mot de passe requis']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, email, mot_de_passe, nom, prenom, role, telephone FROM utilisateurs WHERE email = ?");
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if (!$u || !password_verify($motDePasse, $u['mot_de_passe'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Identifiants invalides']);
        exit;
    }

    $user = [
        'id' => (int)$u['id'],
        'email' => $u['email'],
        'nom' => $u['nom'],
        'prenom' => $u['prenom'],
        'role' => $u['role'],
        'telephone' => $u['telephone']
    ];

    $token = signToken([
        'id' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'exp' => time() + (7 * 24 * 60 * 60)
    ]);

    echo json_encode([
        'token' => $token,
        'user' => $user
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur: ' . $e->getMessage()]);
}
?>
