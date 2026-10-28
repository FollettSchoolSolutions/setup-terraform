# Committed together with terraform.tfstate so that `terraform plan` reports
# "No changes". terraform_data is built in, so no provider download is needed.
resource "terraform_data" "static" {
  input = "static"
}

output "static" {
  value = terraform_data.static.output
}
