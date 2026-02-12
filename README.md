# 로블록스 채팅 신고 자동 검사 및 차단 봇 "갓파더"

<img src="./대부.png" alt="Godfather Bot" width="60%"/>

### "이제 마무리를 짓자고."

이 프로젝트는 로블록스 게임에서 신고 데이터를 받아 해당 사용자를 자동으로 차단하거나 관리자가 검토할 수 있도록 돕는 Discord 봇입니다.
원래 오픈소스 계획이 없었던 프로젝트임을 고려하여 코드 및 문서가 다소 미흡할 수 있음을 양해 부탁드립니다.

> [!WARNING]
> 이 프로젝트는 AI의 판단에 따른 즉시 차단 등 위험한 기능을 다룹니다. 이 문서를 끝까지 읽어보시기 바랍니다.

### 주요 기능

- Discord 봇을 통해 신고 명령어 처리
- Express 서버를 통해 로블록스 신고 데이터 수신
- LLM API를 사용하여 신고 내용 자동 분석
- 로블록스 Openblox 라이브러리를 사용하여 사용자 즉시 차단

---

## 구현 방법

### 요구 사항

- [Node.js](https://nodejs.org/) (버전 16 이상 권장)
- [Discord 봇](https://discord.com/developers/applications)
- [LLM API 키](https://openrouter.ai/)
- [로블록스 클라우드 키](https://create.roblox.com/docs/ko-kr/cloud/auth/api-keys)

그리고..

- **봇 서버**: 항상 켜져 있어야 합니다. (Replit, AWS, Heroku 등)

### 로블록스 스크립트

> [!WARNING]
> 로블록스 특성상 개발자 배신이 잦습니다. 반드시 로블록스의 Secret 기능을 사용하여 비밀 코드를 다른 개발자가 알 수 없도록 해야 합니다.

```lua
function SendToBot(Reporter, Reason, TargetPlr, isChat)
	local logData = GetSerializedChatLogs(TargetPlr, isChat)

	local payload = {
		reporter = Reporter.Name .. " (" .. Reporter.UserId .. ")",
		target = TargetPlr.Name .. " (" .. TargetPlr.UserId .. ")",
		reason = Reason,
		logs = logData,
	}

	local success, response = pcall(function()
		return HttpService:PostAsync(API_URL, HttpService:JSONEncode(payload), Enum.HttpContentType.ApplicationJson)
	end)

	return success
end
```

이 함수를 참고하여 로블록스 게임 내에서 신고가 발생할 때마다 Discord 봇으로 데이터를 전송할 수 있습니다.

다음은 전송되는 데이터의 구조입니다:

- reporter: 신고자 정보
- target: 신고 대상자 정보
- reason: 신고 사유
- logs: 신고 관련 채팅 로그

API_URL은 Express 서버의 엔드포인트 URL로 설정해야 합니다.

### config.json 설정

```json
{
  "testServer": "",
  "clientId": "",
  "devs": [""],
  "PORT": 3001,
  "token": "",
  "KEY": "",
  "CLOUDKEY": "",
  "SECRET_CODE": ""
}
```

- `testServer`: 테스트용 Discord 서버 ID (미사용)
- `clientId`: Discord 봇 클라이언트 ID
- `devs`: 봇 관리자 Discord ID 목록
- `PORT`: Express 서버 포트 번호
- `token`: Discord 봇 토큰
- `KEY`: LLM API 키
- `CLOUDKEY`: 로블록스 클라우드 키
- `SECRET_CODE`: 비밀 코드

> [!WARNING]
> 로블록스 특성상 개발자 배신이 잦습니다. 반드시 로블록스의 Secret 기능을 사용하여 비밀 코드를 다른 개발자가 알 수 없도록 해야 합니다. 두 번 경고하는 이유는 그만큼 중요하기 때문입니다.

### 설치 및 실행

1. `config.json.example` 파일을 `config.json`으로 이름을 변경하고 필요한 설정 값을 입력합니다.
2. 필요한 Node.js 패키지를 설치합니다:
   ```bash
   yarn
   ```
3. 봇을 시작합니다:
   ```bash
   yarn start
   ```

---

## 사용 방법

### LLM 설정

현재 신고 검사용 프롬프트는 특정 게임에 맞게 최적화되어 있습니다. 필요에 따라 프롬프트를 수정하여 다른 게임이나 커뮤니티 가이드라인에 맞게 조정할 수 있습니다. 또한, Fireworks가 아닌 다른 LLM API를 사용하려면 해당 부분의 코드를 수정해야 합니다.

### 채널 설정

코드의 변수 중 `REPORT_CHANNEL_ID`에 신고 알림을 받고 이를 처리할 Discord 채널 ID를 입력합니다.

### Discord 봇 명령어

- `!신고검사` : 이미 수신된 신고 데이터를 검사합니다. 이 때는 별도로 차단을 수행하지 않습니다. (이 경우에는 테스트용으로 판단되어 실제 차단이 이루어지지 않습니다.)
- `/유저확인` (예정) : 특정 사용자의 밴 여부와 사유를 확인합니다.
- `/밴해제` (예정) : 특정 사용자를 밴 해제합니다.

### 제안 모드 (예정)

봇이 자동으로 차단을 수행하지 않고, 관리자에게 제안만 하는 모드입니다. `AUTO_BAN` 변수를 `false`로 설정하여 활성화할 수 있습니다. 이를 설정하면 AI가 자동 차단 대신 기간을 제안하며, 승인/거절 버튼으로 관리자가 직접 차단 여부를 결정할 수 있습니다.

---

## 사용 전 필독

### AI 판단의 한계

이 봇은 법적·운영적 판단을 대체할 수 없습니다. AI의 판단 결과는 확률적이며, 실제 서비스에서는 관리자의 신중한 검토가 필요합니다.
따라서 이 봇을 사용할 때는 다음 사항을 반드시 고려해야 합니다:

- AI의 판단이 항상 정확하지 않을 수 있습니다.
- 잘못된 차단으로 인한 피해에 대해 책임을 지지 않습니다.

### 프롬프트 설명

현재 코드에 사용중인 프롬프트는 다음과 같이 설명됩니다:

- AI는 로블록스 커뮤니티 가이드라인을 준수하여 신고된 채팅이 위반되는지 판단합니다.
- 유효한 위반 사유에는 욕설, 스팸, 부적절한 콘텐츠, 인종차별이 포함됩니다.
- 로블록스는 아동 친화적인 환경이므로 성적이거나 암시적인 언어에 대해 특별히 민감하게 반응합니다.
- 한국어 속어를 사용하는 경우에도 필터를 우회하려는 시도를 감안합니다.
- 의심스러운 경우, 대상 청중에 미성년자가 포함된 경우 부적절한 콘텐츠로 간주합니다.

본 프롬프트는 한국어에 최적화되어 있으며, 다른 언어에서는 성능이 저하될 수 있습니다.
현재 코드조차 완벽하지 않으며, 사용 LLM에 따라 기준이 달라지므로 신중한 사용이 필요합니다.

### 항소 시스템의 부재

현재 이 봇은 잘못된 차단에 대한 항소 시스템을 제공하지 않습니다. 따라서 별도의 봇을 이용하여 항소 시스템을 구축하거나, 관리자가 직접 항소를 처리해야 합니다. AI로 항소를 자동 처리하는 것은 권장되지 않습니다. (그리고 로블록스가 이미 좋은 선례를 가지고 있습니다.)

### 책임의 한계

이 프로젝트는 교육 및 참고용으로 제공되며, 사용자가 이 코드를 사용하여 발생하는 모든 결과에 대한 책임은 사용자에게 있습니다. 개발자는 이 코드의 사용으로 인한 어떠한 손해에 대해서도 책임을 지지 않습니다.
