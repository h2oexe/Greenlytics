import type { GoalStatus, PlanName, SubscriptionStatus, UserRole } from "../types/api";

export function formatNumberLabel(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits }).format(value);
}

export function formatDateLabel(value: string | null) {
  if (!value) {
    return "Belirtilmedi";
  }

  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

export function formatDateTimeLabel(value: string | null) {
  if (!value) {
    return "Belirtilmedi";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatPeriodLabel(value: string) {
  const monthlyMatch = /^(\d{4})-(\d{2})$/.exec(value);

  if (monthlyMatch) {
    const year = Number(monthlyMatch[1]);
    const month = Number(monthlyMatch[2]) - 1;

    return new Intl.DateTimeFormat("tr-TR", {
      month: "short",
      year: "numeric"
    }).format(new Date(year, month, 1));
  }

  return value;
}

export function formatRoleLabel(role: UserRole | undefined) {
  switch (role) {
    case 0:
    case "Admin":
      return "Yönetici";
    case 1:
    case "Manager":
      return "Sorumlu";
    case 2:
    case "Viewer":
      return "Görüntüleyici";
    default:
      return "Kullanıcı";
  }
}

export function formatPlanLabel(name: PlanName) {
  switch (name) {
    case 0:
      return "Temel";
    case 1:
      return "Pro";
    case 2:
      return "Kurumsal";
    default:
      return "Plan";
  }
}

export function formatSubscriptionStatusLabel(status: SubscriptionStatus) {
  switch (status) {
    case 0:
      return "Aktif";
    case 1:
      return "Deneme";
    case 2:
      return "Gecikmiş";
    case 3:
      return "İptal";
    case 4:
      return "Eksik";
    default:
      return "Bilinmiyor";
  }
}

export function formatGoalStatusLabel(status: GoalStatus | string) {
  switch (status) {
    case 0:
    case "Active":
      return "Aktif";
    case 1:
    case "Achieved":
      return "Tamamlandı";
    case 2:
    case "Missed":
      return "Kaçırıldı";
    case 3:
    case "Cancelled":
      return "İptal";
    default:
      return typeof status === "string" ? status : "Bilinmiyor";
  }
}
