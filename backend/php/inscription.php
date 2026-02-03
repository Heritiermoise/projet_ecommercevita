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
$nom = $input['nom'] ?? null;
$prenom = $input['prenom'] ?? null;
$telephone = $input['telephone'] ?? null;
$role = $input['role'] ?? 'client';

if (empty($email) || strlen($motDePasse) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Email requis et mot de passe de 6 caractères min.']);
    exit;
}

try {
    // Vérifier si l'utilisateur existe déjà
    $stmt = $pdo->prepare("SELECT id FROM utilisateurs WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email déjà utilisé']);
        exit;
    }

    // Un seul admin autorisé (comme dans l'API Node)
    if ($role === 'admin') {
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM utilisateurs WHERE role = 'admin'");
        $admin = $stmt->fetch();
        if ($admin['count'] >= 1) {
            http_response_code(409);
            echo json_encode(['error' => "Un administrateur existe déjà. Choisis 'client'."]);
            exit;
        }
    }

    $hashedPassword = password_hash($motDePasse, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("INSERT INTO utilisateurs (email, mot_de_passe, nom, prenom, telephone, role) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$email, $hashedPassword, $nom, $prenom, $telephone, $role]);
    
    $userId = $pdo->lastInsertId();
    
    $user = [
        'id' => (int)$userId,
        'email' => $email,
        'nom' => $nom,
        'prenom' => $prenom,
        'role' => $role
    ];

    $token = signToken([
        'id' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'exp' => time() + (7 * 24 * 60 * 60) // 7 jours
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
