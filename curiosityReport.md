# JWT Fundamentals

JSON Web Token. A JWT is essentially a security envelope that allows secure communication between 2 parties. Like signing for a package, part of the security is in the record keeping that the envelope was sent from the correct source and arrived at the correct destination with contents intact and unchanged. 

JWT is commonly used for authorization and information exchange. Single Sign On widely uses JWT because of it's relatively small cost and transversability across domains. 

## Format

JWT consists of 3 parts, each of which is Base64Url encoded:

1. *Header*: consists of two parts, a signing algorithm, like RSA, and its type, JWT.

2. *Payload*: consists of claims (registered, public, and private) which are statements, typically about the user, and additional data. Registered claims are a set of predefined claims, such as iss (issuer), exp (expiration), sub (subject), aud (audience), etc. Public claims are defined by the user at will (at risk of collisions). Private claims are custom to the exchange and defined by both parties.

3. *Signature*: the header and payload are encoded, separated with a . and then passed with a secret into the algorithm passed in the header to create the signature. This signature ensures tampering verification as well as sender verification.

These are presented as **header.payload.signature**. As an example, the following JWT: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.NHVaYe26MbtOYhSKkoKYdFVomg4i8ZJd8_-RU8VNbftc4TSMb4bXP3l3YlNWACwyXPGffz5aXHc6lty1Y2t4SWRqGteragsVdZufDn5BlnJl9pdR_kdVFUsra2rWKEofkZeIC4yWytE58sMIihvo9H1ScmmVwBcQP6XETqYd0aSHp1gOa9RdUPDvoXQ5oqygTqVtxaDr6wUFKrKItgBMzWIdNZ6y7O9E0DhEPTbE9rfBo6KTFsHAZnMg4k68CDp2woYIaXbmYTWcvbzIuHO7_37GT79XdIwkm95QJ7hYC9RiwrV7mesbY4PAahERJawntho0my942XheVLmGwLMBkQ` corresponds to this header, payload, and signature: 
```
{
  "alg": "RS256",
  "typ": "JWT"
}
```

```
{
  "sub": "1234567890",
  "name": "John Doe",
  "admin": true,
  "iat": 1516239022
}
```

`MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB`



In JWT Pizza, the pizzas we recieve from the factory contain some the following:

1. Header:
- `"iss": "cs329.click` (JWT came from pizza-factory.cs329.click)
- `"alg": "RS256"` (the factory uses RSA with SHA-256 Hashing to encode the JWT)

2. Payload:
- Vendor: Me
- `"diner": {"id":3, "name": "pizza diner", "email": "d@jwt.com:"}`
- `"order: {"items": [{"menuID": 1, "description": "Veggie", "price": 0.0038}], "storeId": "1", "franchiseId": 1, "id": 730}`

3. Signature:
- public Key



## Functions and Advantages

A JWT is essentially an authorization token. In fact, it a standard. All JWTs are Tokens, but not all tokens are JWTs. When we send an athorization header such as the following: `Authorization: Bearer <token>`, if the JWT is still valid (for example, it has not expired), the user can be given access to protected resources.

Much of the JWT's advantage over other web tokens, such as Simple Web Tokens (SWT) and Security Assertion Markup Language Tokens (SAML), lies in its JSON use. JSON is more succinct than XML, and has a smaller size when encoded, making it more compact and usable by HTML and HTTP. JSON parsers are also more readily used by many programming languages because of the emphasis on objects, meaning JWT is easier to work with across code bases.

A JWT contains all required information about an entity that it can usually avoid querying a database more than once. The signature of the JWT also means that any recipient does not need to call the server to validate the token.

## Validation and Verification

Validation: Check the structure, format, and content 
- *Structure*: does it match header.payload.signature?
- *formaat*: are all expected claims and encodings present?
- *content*: are all claims correct? (ex: is it expired?)

Verification: confirm authenticity or integrity
- *signature*: Using the algorithm specified and the signature of the JWT, the header and payload are checked against the signature. Descrepancies could indicate the JWT was tampered with or that the source is not trustworthy.
-*issuer*: Does the iss claim match the expected issuer?
-*audience*: does the aud claim match the expected audience?

JWT verification will often combine these into one set of steps, verifying and validating in one action. It is very important to note, however, that even if a JWT has been verified and validated, its contents could have simply been read. Any information within the JWT is stored in plain text. Sensitive information should not be stored inside a JWT, and additional security measures are required to secure safe transit of the JWT.

## Types

There are two types of JWT: 
- JSON Web Signature (JWS)
- JSON Web Encryption (JWE)

The payload of a JWS is public, readable by anyone. JWE however requires both the token and an encryption. Its contents are not just encoded, but also encrypted. A standard JWT uses a JWS.

## Problems

Given how widespread JWT is used, there are certain concerns to be aware of. A JWT attack involves a user sending a modified JWT to a server for malicious intent, usually to bypass authentication and access controls by impersonating another authenticated user. 

JWT vulnerabilities usually come from how any given application is specified to handle JWTs. JWTs are relatively flexible by design, meanging that implementation is equally flexible, so developers can accidently introduce vulnerabilities during implementation. Such a vulnerability usually disrupts the JWT signature verification. 

Another issue is the leakage of the server's secret key, which would allow any attacker to generate their own completely valid tokens.

### Flawed Verification

By design, servers don't usually store anything about the JWTs they issue. This helps maintain the client-side ease of JWT use. This does however mean that the server has no idea what the original contents or even signature of a JWT was. if it can't verify a JWT correctly, then any arbitrary change to the token could lead to attacks. For example:

```
{
    "username": "carlos",
    "isAdmin": false
}
```

if a server identifies a session by the username alone or the isAdmin alone, then arbitrary changes to these values could allow impersonation and false-access. 

### Arbitrary Signature Acception

The Node.js library jsonWebToken has `verify()` and `decode()`. If a developer forgets to pass the token through both, any and all tokens are simply recieved and read, never verified.

### Tokens without a Signature

An important aspect of the header is the `"alg":` parameter, which indicates teh server what algorithm was used to sign the JWT and by extension what algorithm to use to verify it. There is an inherent flaw here in that the server **must** implicity trust a user-controllable input from the token which has not and cannot yet been verified. This means that an attacker can influence how the server verifies the trustworthiness of the token.

The token can be left unsigned, setting alg to `"alg": none`, which indicates an unsecured JWT. Servers will often reject tokens without a signature, but recognition of this requires string parsing, which has its own dangers and flaws if not properly recognized and addressed.

### JWT Header Injections

JWS specification only requires the `alg` as a mandatory header, but in practice, often contain others. The `jwk`, `jku`, `kid` are each of particular interest to attackers. 

The `jwk` specifies a JSON Web Key so a server can embed their public key into the JWT. A misconfigured server can accidently accept any key in a `jwk` parameter

The `jku` specifies a JSON Web Key Set URL that servers can fetch a set of keys from. Servers that don't have protocol in place to fetch keys only from trusted domains are easy prey to false `jku` injections, but URL parsing discrepancies can sometimes bypass the trusted domain filtering as well.

The `kid` identifies a Key ID. Some servers may use several keys for different kinds of tokens and use the `kid` to identify which key to use for a specific token. There is no concrete structure for a `kid`, so it could anything from a string, to a database entry to a filename. This is especially dangerous due to the possibility of directory traversal or SQL injection. If the server supports JWTs signed with a symmmetric algorithm, an attacker could point the `kid` at a predictable, static file and sign the JWT with a secret matching its contents, such as `/dev/null`.

### Algorithm Confusion

Even if a server is robust and resistant to brute-force attacks, it is still possible to potentially forge a valid JWT by signing it with an algorithm unanticipated by the developers.

## Attack Prevention

In general, do the following to prevent attacks associated with those mentioned above:
- Update and know the implications of any and all libraries you are using to hand JWTs. Nothing is foolproof.
- Verify robustly and account for edge-cases, such as JWTs signed with unexpected algorithms
- Enforce strict handling of the `jku`
- Ensure `kid` is not vulnerable to path traversal or SQL injection
- Always set an expiration date for issued tokens
- Avoid sending tokens in URL parameters.
- Include a claim specifying the intended recipient of the JWT (such as `aud`)
- Ensure the issueing server can revoke tokens


### Sources:
- [jwt.io](https://www.jwt.io/introduction#difference-decoding-encoding-jwt)
- [auth0.com](https://auth0.com/docs/secure/tokens/json-web-tokens)
- [portswigger.net](https://portswigger.net/web-security/jwt)