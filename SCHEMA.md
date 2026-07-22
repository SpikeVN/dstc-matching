# User
id
(
text, required)

UUID từ GoTrue
email
(
text, required)

Email đăng nhập
username
(
text)

Tên đăng nhập (dùng để đăng nhập thay email)
full_name
(
text)

Họ tên đầy đủ (từ Google login, có thể để trống)
role
(
text)

Vai trò hệ thống
Default: "user"
created_date
(
timestamp)

Ngày tạo
updated_date
(
timestamp)

Ngày cập nhật

# ContestantProfile
display_name
(
text, required)

Họ tên đầy đủ
username
(
text, required)

Tên đăng nhập
bio
(
text)

Giới thiệu ngắn về bản thân
birth_year
(
number)

Năm sinh
gender
(
text)

Giới tính
Options: Nam, Nữ, Không muốn nói
city
(
text)

Nơi ở hiện tại
school
(
text)

Trường Đại học/THPT
major
(
text)

Ngành học
profile_image
(
text)

URL ảnh đại diện
technical_skills
(
array)

Kỹ năng kỹ thuật (tools + frameworks + skillset)

soft_skills
(
array)

Mindset & Soft skills

experience
(
text)

Kinh nghiệm thi
Options: Chưa thi lần nào, Đã thi cuộc thi về DA/DSTC, Đã thi DSTC nhiều lần
goals
(
array)

Mục tiêu tham gia

role
(
text)

Vai trò mong muốn
Options: Data Analyst, ML Engineer, Backend Developer, Quant Researcher, Quant Developer, Quant Trader, All-rounder
achievements
(
text)

Thành tích nổi bật
achievements_other
(
text)

Thành tích khác
has_team
(
boolean)

Đã có đội chưa
Default: false
team_id
(
text)

ID đội
profile_complete
(
boolean)

Đã hoàn thành hồ sơ chưa
Default: false

# Match
user1_id
(
text, required)

ID người dùng 1
user2_id
(
text, required)

ID người dùng 2
status
(
text)

Trạng thái match
Default: "matched"
Options: matched, team_invited, team_joined
user1_confirmed
(
boolean)

User1 đã xác nhận lập đội
Default: false
user2_confirmed
(
boolean)

User2 đã xác nhận lập đội
Default: false

# Message
match_id
(
text, required)

ID match
sender_id
(
text, required)

ID người gửi
receiver_id
(
text)

ID người nhận
content
(
text, required)

Nội dung tin nhắn
is_read
(
boolean)

Đã đọc chưa
Default: false

# SwipeAction

swiper_id
(
text, required)

ID người quẹt
swiped_id
(
text, required)

ID người bị quẹt
action
(
text, required)

Hành động quẹt
Options: like, pass
is_match
(
boolean)

Đã match chưa
Default: false

# Team
name
(
text, required)

Tên đội
leader_id
(
text, required)

ID trưởng đội
member_ids
(
array)

Danh sách ID thành viên

max_members
(
number)

Số thành viên tối đa
Default: 4
status
(
text)

Trạng thái đội
Default: "forming"
Options: forming, full, locked

# TeamInvite

team_id
(
text, required)

ID đội
inviter_id
(
text, required)

ID người mời
invitee_id
(
text, required)

ID người được mời
status
(
text)

Trạng thái lời mời
Default: "pending"
Options: pending, accepted, rejected