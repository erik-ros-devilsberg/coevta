@extends('layouts.app')

@section('title', 'Log in')

@section('content')
	<main>
		<h1>Log in</h1>

		@if ($errors->any())
			<ul class="errors">
				@foreach ($errors->all() as $error)
					<li>{{ $error }}</li>
				@endforeach
			</ul>
		@endif

		<form method="POST" action="{{ route('login') }}">
			@csrf

			<label>
				Email
				<input type="email" name="email" value="{{ old('email') }}" required autofocus>
			</label>

			<label>
				Password
				<input type="password" name="password" required>
			</label>

			<button type="submit">Log in</button>
		</form>
	</main>
@endsection
