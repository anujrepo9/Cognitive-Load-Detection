def test_register_login_refresh_and_profile(client):
    registration = client.post(
        "/auth/register",
        json={"name": "Ada Lovelace", "email": "ada@example.com", "password": "safe-password"},
    )

    assert registration.status_code == 201
    tokens = registration.json()
    assert tokens["user"] == {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com"}
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    profile = client.get("/auth/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["email"] == "ada@example.com"

    login = client.post(
        "/auth/login",
        json={"email": "ada@example.com", "password": "safe-password"},
    )
    assert login.status_code == 200

    refresh = client.post("/auth/refresh", json={"refresh_token": login.json()["refresh_token"]})
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]


def test_auth_rejects_duplicate_registration_and_invalid_login(client):
    payload = {"name": "Test User", "email": "duplicate@example.com", "password": "test-password"}
    assert client.post("/auth/register", json=payload).status_code == 201

    duplicate = client.post("/auth/register", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "conflict"

    invalid_login = client.post(
        "/auth/login",
        json={"email": "duplicate@example.com", "password": "incorrect-password"},
    )
    assert invalid_login.status_code == 401
    assert invalid_login.json()["error"]["code"] == "unauthorized"
