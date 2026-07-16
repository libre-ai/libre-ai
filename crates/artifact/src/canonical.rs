use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fmt::Write;

pub fn canonical_json(value: &Value) -> Result<Vec<u8>, serde_json::Error> {
    let mut output = Vec::new();
    write_value(value, &mut output)?;
    Ok(output)
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut encoded = String::with_capacity(64);
    for byte in digest {
        write!(&mut encoded, "{byte:02x}").expect("writing to a String cannot fail");
    }
    encoded
}

fn write_value(value: &Value, output: &mut Vec<u8>) -> Result<(), serde_json::Error> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
            serde_json::to_writer(&mut *output, value)?;
        }
        Value::Array(values) => {
            output.push(b'[');
            for (index, nested) in values.iter().enumerate() {
                if index > 0 {
                    output.push(b',');
                }
                write_value(nested, output)?;
            }
            output.push(b']');
        }
        Value::Object(object) => {
            output.push(b'{');
            let mut keys = object.keys().collect::<Vec<_>>();
            keys.sort();
            for (index, key) in keys.into_iter().enumerate() {
                if index > 0 {
                    output.push(b',');
                }
                serde_json::to_writer(&mut *output, key)?;
                output.push(b':');
                write_value(&object[key], output)?;
            }
            output.push(b'}');
        }
    }
    Ok(())
}
