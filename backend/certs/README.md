# Bundled database trust

supabase-root.pem is the public Supabase Root 2021 CA, downloaded from the NovaWorks project's SSL configuration and verified against the live Session Pooler connection. It contains no private key or credential.

SHA256 certificate fingerprint: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
Expiry: 26 April 2031.

The backend trusts this certificate only for Supabase database/pooler hostnames and retains rejectUnauthorized:true. Certificate trust and hostname validation remain enabled. Update this public certificate if Supabase rotates its root. Custom non-Supabase database endpoints still use their configured CA or standard trust store.
