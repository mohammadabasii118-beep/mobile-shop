"use client";

import { Component, type ReactNode } from "react";

/** خطای WebGL/Canvas هرگز صفحه را خراب نکند — fallback دو‌بعدی نمایش داده می‌شود */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[3D] fallback activated:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
