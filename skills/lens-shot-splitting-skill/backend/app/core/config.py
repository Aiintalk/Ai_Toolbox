from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Lens Analysis API"
    app_env: str = "development"
    backend_cors_origins: str = "http://localhost:3000"
    database_url: str | None = None
    ffmpeg_path: str | None = None
    ffprobe_path: str | None = None
    auth_username: str = "admin"
    auth_password: str = "admin123"
    auth_display_name: str = "管理员"
    auth_token_secret: str = "lens-analysis-development-secret"
    auth_token_ttl_seconds: int = 12 * 60 * 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
