"use client";

import { useId } from "react";
import { CModal, CModalBody, CModalHeader, CModalTitle } from "@coreui/react";

export default function AppDialog({ visible, onClose, title, children, size }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "lg" | "xl";
}) {
  const titleId = useId();

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size={size} aria-labelledby={titleId}>
      <CModalHeader>
        <CModalTitle id={titleId}>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>{children}</CModalBody>
    </CModal>
  );
}
