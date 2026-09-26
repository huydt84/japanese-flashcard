import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư",
  description: "Cách Kotoba thu thập, sử dụng và bảo vệ dữ liệu của người dùng.",
};

const sections = [
  {
    title: "Dữ liệu Kotoba thu thập",
    paragraphs: [
      "Khi bạn đăng nhập bằng Google, Kotoba nhận các thông tin cơ bản mà bạn cho phép Google chia sẻ, gồm tên, địa chỉ email, ảnh đại diện và mã định danh tài khoản. Kotoba không nhận hoặc lưu mật khẩu Google của bạn.",
    ],
    items: [
      "Vai trò giáo viên hoặc học sinh mà bạn chọn trong lần đầu sử dụng.",
      "Lớp học, bài học, thẻ từ vựng, lời mời và quan hệ thành viên có liên quan đến tài khoản.",
      "Kết quả ôn tập, lịch ôn tiếp theo và thời điểm hoạt động gần nhất để vận hành tính năng ghi nhớ ngắt quãng.",
      "Thông báo trong ứng dụng và trạng thái đã đọc.",
    ],
  },
  {
    title: "Cách dữ liệu được sử dụng",
    paragraphs: [
      "Kotoba chỉ dùng dữ liệu để xác thực tài khoản, cung cấp đúng không gian giáo viên hoặc học sinh, vận hành lớp học, sắp lịch ôn và hiển thị tiến độ cho những người có quyền trong cùng lớp.",
      "Kotoba không bán dữ liệu cá nhân và không dùng dữ liệu học tập cho quảng cáo nhắm mục tiêu.",
    ],
  },
  {
    title: "Lưu trữ và bảo vệ",
    paragraphs: [
      "Dữ liệu được lưu trên hạ tầng Supabase. Quyền truy cập được giới hạn theo tài khoản và lớp học: giáo viên chỉ quản lý lớp của mình; học sinh chỉ truy cập lớp đã tham gia và tiến độ của chính mình. Phiên đăng nhập được bảo vệ bằng cookie an toàn phía máy chủ.",
    ],
  },
  {
    title: "Chia sẻ dữ liệu",
    paragraphs: [
      "Kotoba chỉ chuyển dữ liệu cần thiết cho Google để đăng nhập, Supabase để xác thực và lưu trữ, và Vercel để phân phối ứng dụng. Dữ liệu cũng được hiển thị cho giáo viên hoặc học sinh trong cùng lớp đúng với chức năng của sản phẩm.",
    ],
  },
  {
    title: "Lựa chọn của bạn",
    paragraphs: [
      "Bạn có thể ngừng sử dụng Kotoba hoặc thu hồi quyền truy cập của Kotoba trong phần bảo mật của Tài khoản Google. Nếu cần xem, sửa hoặc yêu cầu xóa dữ liệu, hãy liên hệ quản trị viên Kotoba qua thông tin hỗ trợ hiển thị trên màn hình đồng ý của Google.",
    ],
  },
  {
    title: "Thay đổi chính sách",
    paragraphs: [
      "Kotoba có thể cập nhật chính sách này khi sản phẩm hoặc yêu cầu pháp lý thay đổi. Phiên bản mới sẽ được đăng tại trang này cùng ngày cập nhật.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Chính sách quyền riêng tư"
      description="Kotoba tôn trọng dữ liệu học tập của bạn. Trang này giải thích dữ liệu nào được thu thập, vì sao cần dùng và ai có thể truy cập."
      sections={sections}
    />
  );
}
