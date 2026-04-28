from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./users.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class DeviceVisit(Base):
    __tablename__ = "device_visits"
    id               = Column(Integer, primary_key=True, index=True)
    device_id        = Column(String, nullable=False, index=True)
    ip_address       = Column(String, nullable=True)
    user_agent       = Column(Text, nullable=True)
    platform         = Column(String, nullable=True)
    languages        = Column(String, nullable=True)
    timezone         = Column(String, nullable=True)
    timezone_offset  = Column(Integer, nullable=True)
    screen_width     = Column(Integer, nullable=True)
    screen_height    = Column(Integer, nullable=True)
    avail_width      = Column(Integer, nullable=True)
    avail_height     = Column(Integer, nullable=True)
    color_depth      = Column(Integer, nullable=True)
    pixel_ratio      = Column(Float, nullable=True)
    touch_points     = Column(Integer, nullable=True)
    hardware_cores   = Column(Integer, nullable=True)
    device_memory_gb = Column(Float, nullable=True)
    connection_type  = Column(String, nullable=True)
    effective_type   = Column(String, nullable=True)
    downlink_mbps    = Column(Float, nullable=True)
    rtt_ms           = Column(Float, nullable=True)
    save_data        = Column(Boolean, nullable=True)
    webgl_vendor     = Column(String, nullable=True)
    webgl_renderer   = Column(String, nullable=True)
    canvas_fp        = Column(String, nullable=True)
    ua_brands        = Column(String, nullable=True)
    ua_mobile        = Column(Boolean, nullable=True)
    ua_platform      = Column(String, nullable=True)
    latitude         = Column(Float, nullable=True)
    longitude        = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)
    visited_at       = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String, nullable=False, index=True)   # stores device fingerprint ID
    thread_id  = Column(String, unique=True, nullable=False)
    topic      = Column(String, nullable=False)
    status     = Column(String, default="in_progress")
    content    = Column(Text, nullable=True)
    docx_path  = Column(String, nullable=True)
    pdf_path   = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)
