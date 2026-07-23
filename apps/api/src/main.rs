// Minimal HTTP server exposing the "real" (anonymous) contributions graph.
// The trick is deliberately NOT authenticating: a plain cookieless GET returns
// the full opted-in aggregate that identified viewers get SSO-stripped.

use the_real_contributions_graph_api::parse_contributions;
use tiny_http::{Header, Method, Response, Server};

const ADDR: &str = "0.0.0.0:8799";

fn main() {
    let server = Server::http(ADDR).expect("bind server");
    println!("api listening on http://{ADDR}");
    for request in server.incoming_requests() {
        handle(request);
    }
}

fn handle(request: tiny_http::Request) {
    if *request.method() != Method::Get {
        let _ = request.respond(json_response(405, r#"{"error":"method not allowed"}"#));
        return;
    }

    let username = request
        .url()
        .strip_prefix("/contributions/")
        .map(|s| s.split(['?', '/']).next().unwrap_or("").to_string());

    let (status, body) = match username {
        Some(name) if is_valid_username(&name) => match fetch_html(&name) {
            Ok(html) => match serde_json::to_string(&parse_contributions(&html)) {
                Ok(json) => (200, json),
                Err(_) => (500, error("failed to serialize")),
            },
            Err(e) => (502, error(&format!("fetch failed: {e}"))),
        },
        Some(_) => (400, error("invalid username")),
        None => (404, error("not found")),
    };

    let _ = request.respond(json_response(status, &body));
}

fn fetch_html(username: &str) -> Result<String, String> {
    let url = format!("https://github.com/users/{username}/contributions");
    // No token, no cookies: this is the anonymous/incognito view.
    ureq::get(&url)
        .set("User-Agent", "the-real-contributions-graph")
        .call()
        .map_err(|e| e.to_string())?
        .into_string()
        .map_err(|e| e.to_string())
}

// GitHub usernames: 1-39 chars, alphanumeric or single hyphens.
fn is_valid_username(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 39
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn error(message: &str) -> String {
    format!(r#"{{"error":"{}"}}"#, message.replace('"', "'"))
}

fn json_response(status: u16, body: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut response = Response::from_string(body).with_status_code(status);
    for (key, value) in [
        ("Content-Type", "application/json"),
        ("Access-Control-Allow-Origin", "*"),
    ] {
        if let Ok(header) = Header::from_bytes(key.as_bytes(), value.as_bytes()) {
            response.add_header(header);
        }
    }
    response
}
