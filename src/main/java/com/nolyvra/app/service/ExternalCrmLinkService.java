package com.nolyvra.app.service;

import com.nolyvra.app.model.ExternalCrmLink;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;

@Service
public class ExternalCrmLinkService {

    private final JdbcTemplate jdbc;

    public ExternalCrmLinkService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ExternalCrmLink findByLocalRecord(
            String loginId, String provider, String localType, String localId) {
        return jdbc.query("""
                select id, login_id, provider, local_type, local_id, external_id,
                       external_url, last_synced_at, last_sync_status, last_sync_error
                from external_crm_link
                where login_id = ? and provider = ? and local_type = ? and local_id = ?
                """, rs -> rs.next() ? mapRow(rs) : null,
                loginId, provider, localType, localId);
    }

    public void acquireLocalRecordLock(
            String loginId, String provider, String localType, String localId) {
        String lockKey = String.join(":", loginId, provider, localType, localId);
        jdbc.query("select pg_advisory_xact_lock(hashtext(?))",
                (ResultSetExtractor<Void>) rs -> null,
                lockKey);
    }

    public ExternalCrmLink recordSuccess(
            String loginId,
            String provider,
            String localType,
            String localId,
            String externalId,
            String externalUrl) {
        jdbc.update("""
                insert into external_crm_link
                    (login_id, provider, local_type, local_id, external_id, external_url,
                     last_synced_at, last_sync_status, last_sync_error)
                values (?, ?, ?, ?, ?, ?, now(), 'success', null)
                on conflict (login_id, provider, local_type, local_id) do update set
                    external_id = excluded.external_id,
                    external_url = excluded.external_url,
                    last_synced_at = excluded.last_synced_at,
                    last_sync_status = 'success',
                    last_sync_error = null,
                    updated_at = now()
                """, loginId, provider, localType, localId, externalId, externalUrl);
        return findByLocalRecord(loginId, provider, localType, localId);
    }

    public ExternalCrmLink recordFailure(
            String loginId, String provider, String localType, String localId, String error) {
        jdbc.update("""
                insert into external_crm_link
                    (login_id, provider, local_type, local_id, last_synced_at,
                     last_sync_status, last_sync_error)
                values (?, ?, ?, ?, now(), 'failed', ?)
                on conflict (login_id, provider, local_type, local_id) do update set
                    last_synced_at = excluded.last_synced_at,
                    last_sync_status = 'failed',
                    last_sync_error = excluded.last_sync_error,
                    updated_at = now()
                """, loginId, provider, localType, localId, error);
        return findByLocalRecord(loginId, provider, localType, localId);
    }

    private ExternalCrmLink mapRow(ResultSet rs) throws SQLException {
        OffsetDateTime lastSyncedAt = rs.getObject("last_synced_at", OffsetDateTime.class);
        return new ExternalCrmLink(
                rs.getLong("id"),
                rs.getString("login_id"),
                rs.getString("provider"),
                rs.getString("local_type"),
                rs.getString("local_id"),
                rs.getString("external_id"),
                rs.getString("external_url"),
                lastSyncedAt == null ? null : lastSyncedAt.toInstant(),
                rs.getString("last_sync_status"),
                rs.getString("last_sync_error"));
    }
}
